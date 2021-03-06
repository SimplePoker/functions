const AWS = require('aws-sdk')
const uniq = require('lodash.uniq')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {gameId} = event

    let game = await getGame(gameId)
    game.players = game.players.filter(p => p.seat !== game.currentSeat)

    await removePlayerFromGame(game.id, getExpression(game))
};

// Database
async function removePlayerFromGame (gameId, expression) {
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

function allBetsEqual (players) {
    return uniq(players.map(p => p.bet)).length === 1
}

function everyoneAllIn (players) {
    return !players.filter(p => p.chips > 0).length
}

function getExpression (game) {
    const lastSeat = everyoneAllIn(game.players) && allBetsEqual(game.players) && !game.nextStageProtection
    if(lastSeat){
        return {
            UpdateExpression: `set currentSeat = :SBSeat, players = :players, phase = :nextPhase, nextStageProtection = :protection, pot.main = :totalPot`,
            ExpressionAttributeValues: {
                ':players': game.players,
                ':SBSeat': game.smallBlindSeat,
                ':nextPhase': game.phase + 1,
                ':totalPot': game.pot.total,
                ':protection': true
            }
        }
    }
    return {
        UpdateExpression: `set currentSeat = :nextSeat, players = :players, nextStageProtection = :protection`,
        ExpressionAttributeValues: {
            ':players': game.players,
            ':nextSeat': getNextSeat(game.currentSeat, game.players),
            ':protection': false
        }
    }
}