const AWS = require('aws-sdk')
const uniq = require('lodash.uniq')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {gameId} = event

    let game = await getGame(gameId)

    const chipsToCall = getChipsToCall(game.players, game.currentSeat)
    const currentSeatIndex = game.players.findIndex(p => p.seat === game.currentSeat)
    game.players[currentSeatIndex].chips -= chipsToCall
    game.players[currentSeatIndex].bet += chipsToCall

    return addPlayerBet(game.id, getExpression(game, chipsToCall, currentSeatIndex))
};

// Database
async function addPlayerBet (gameId, expression) {
    const gameUpdateQuery = {
        TableName: `SP-Games-${process.env.STAGE}`,
        Key: {id: gameId},
        ...expression,
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(gameUpdateQuery).promise()).Attributes
}

async function getGame (gameId) {
    const gameGetQuery = {
        TableName: `SP-Games-${process.env.STAGE}`,
        Key: {id: gameId}
    };
    return (await db.get(gameGetQuery).promise()).Item
}

// Helpers
function getNextSeat (seat, players) {
    const seats = players.map(p => p.seat).sort()
    return seats.find(n => n > seat) || Math.min(...seats)
}

function allBetsEqual(players){
    return uniq(players.map(p => p.bet)).length === 1
}

function everyoneAllIn(players){
    return !players.filter(p => p.chips > 0).length
}

function getExpression (game, betValue, currentSeatIndex) {
    const lastSeat = everyoneAllIn(game.players) || allBetsEqual(game.players) && !game.nextStageProtection
    if(lastSeat){
        return {
            UpdateExpression: `set currentSeat = :SBSeat, phase = :nextPhase, nextStageProtection = :protection, pot.main = :totalPot, pot.#total = :totalPot add players[${currentSeatIndex}].chips :chipsReduce, players[${currentSeatIndex}].bet :chipsAdd`,
            ExpressionAttributeValues: {
                ':SBSeat': game.smallBlindSeat,
                ':nextPhase': game.phase + 1,
                ':totalPot': game.pot.total + betValue,
                ':chipsReduce': -betValue,
                ':chipsAdd': betValue,
                ':protection': true
            },
            ExpressionAttributeNames: {
                '#total': 'total'
            }
        }
    }
    return {
        UpdateExpression: `set currentSeat = :nextSeat add players[${currentSeatIndex}].chips :chipsReduce, players[${currentSeatIndex}].bet :chipsAdd, pot.#total :chipsAdd`,
        ExpressionAttributeValues: {
            ':nextSeat': getNextSeat(game.currentSeat, game.players),
            ':chipsReduce': -betValue,
            ':chipsAdd': betValue
        },
        ExpressionAttributeNames: {
            '#total': 'total'
        }
    }
}

function getChipsToCall(players, currentSeat){
    const currentPlayer = players.find(p => p.seat === currentSeat)
    const biggestBet = Math.max(...players.map(p => p.bet))
    const chipsToCall = biggestBet - currentPlayer.bet

    const amountPaid = chipsToCall <= currentPlayer.chips ? chipsToCall : currentPlayer.chips
    return amountPaid
}