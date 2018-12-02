const AWS = require('aws-sdk')
const uniq = require('lodash.uniq')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {gameId, action, value} = event

    /*
    * action/call:
    *   game: reduce players chips, update currentSeat, add game pot total,
    *   if last person: game -> phase += 1
    * action/bet:
    *   game: update currentSeat, update currentSeat, add game pot total,
    * action/fold:
    *   game: update currentSeat, remove player from players
    *   if last person: game -> phase += 1
    * action/check:
    *   game: update currentSeat
    *   if last person: game -> phase += 1
    * */

    const game = await getGame(gameId)

    let phaseAndSeatExpression, currentSeatIndex
    switch(action){
        case 'CALL':
            const chipsToCall = getChipsToCall(game.players, game.currentSeat)
            currentSeatIndex = game.players.findIndex(p => p.seat === game.currentSeat)
            game.players[currentSeatIndex].chips -= chipsToCall
            phaseAndSeatExpression = getPhaseAndSeatExpression(game)
            await addPlayerBet(game.id, chipsToCall, phaseAndSeatExpression)
            break
        case 'CHECK':
            phaseAndSeatExpression = getPhaseAndSeatExpression(game)
            await moveForward(game.id, phaseAndSeatExpression)
            break
        case 'FOLD':
            currentSeatIndex = game.players.findIndex(p => p.seat === game.currentSeat)
            delete game.players[currentSeatIndex]
            await removePlayerFromGame(game, phaseAndSeatExpression)
            break
        case 'BET':
            phaseAndSeatExpression = getPhaseAndSeatExpression(game)
            await addPlayerBet(game.id, value, phaseAndSeatExpression)
            break
    }
};

// Database
async function addPlayerBet(gameId, value, phaseAndSeatExpression){
    const gameUpdateQuery = {
        TableName : `SP-Games-${process.env.STAGE}`,
        Key: {id: gameId},
        UpdateExpression: `add players[0].chips :chips, players[0].chips :bet, pot.#total :bet ${phaseAndSeatExpression}`,
        ExpressionAttributeValues: {
            ':bet': value,
            ':chips': -value
        },
        ExpressionAttributeNames: {
            '#total': 'total'
        },
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(gameUpdateQuery).promise()).Attributes
}

async function removePlayerFromGame(game){
    const lastSeat = everyoneAllIn(game.players) && allBetsEqual(game.players) && !game.nextStageProtection
    const UpdateExpression = lastSeat ? `set currentSeat = :SBSeat, phase = :nextPhase, nextStageProtection = true, pot.main = :totalPot, #p = :players` :
        `set currentSeat = :nextSeat, #p = :players`
    const ExpressionAttributeValues = lastSeat ?
        {
            ':players': game.players,
            ':SBSeat': game.smallBlindSeat,
            ':nextPhase': game.phase + 1,
            ':totalPot': game.pot.total
        } : {
            ':players': game.players,
            ':nextSeat': getNextSeat(game.currentSeat, game.players)
        }
    const gameUpdateQuery = {
        TableName : `SP-Games-${process.env.STAGE}`,
        Key: {id: game.id},
        UpdateExpression,
        ExpressionAttributeValues,
        ExpressionAttributeNames: {
            '#p': 'players'
        },
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(gameUpdateQuery).promise()).Attributes
}

async function moveForward(gameId, phaseAndSeatExpression){
    const gameUpdateQuery = {
        TableName : `SP-Games-${process.env.STAGE}`,
        Key: {id: gameId},
        UpdateExpression: `${phaseAndSeatExpression}`,
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(gameUpdateQuery).promise()).Attributes
}

async function getGame(gameId){
    const gameGetQuery = {
        TableName : `SP-Games-${process.env.STAGE}`,
        Key: {id: gameId}
    };
    return (await db.get(gameGetQuery).promise()).Item
}

// Helpers
function getNextSeat(seat, players) {
    const seats = players.map(p => p.seat).sort()
    return seats.find(n => n > seat) || Math.min(...seats)
}

function allBetsEqual(players){
    return uniq(players.map(p => p.bet)).length === 1
}

function everyoneAllIn(players){
    return !players.filter(p => p.chips > 0).length
}

function getPhaseAndSeatExpression(game) {
    const lastSeat = everyoneAllIn(game.players) && allBetsEqual(game.players) && !game.nextStageProtection
    if(lastSeat){
        return `set currentSeat = :SBSeat, phase = :nextPhase, nextStageProtection = true, pot.main = :totalPot`
    } else {
        return `set currentSeat = :nextSeat`
    }
}

function getChipsToCall(players, currentSeat){
    const currentPlayer = players.find(p => p.seat === currentSeat)
    const biggestBet = Math.max(...players.map(p => p.bet))
    const chipsToCall = biggestBet - currentPlayer.bet

    const amountPaid = chipsToCall <= currentPlayer.chips ? chipsToCall : currentPlayer.chips
    return amountPaid
}
