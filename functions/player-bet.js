const AWS = require('aws-sdk')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {gameId, betValue} = event

    let game = await getGame(gameId)

    await addPlayerBet(game.id, getExpression(game, betValue))
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

function getExpression (game, betValue) {
    return {
        UpdateExpression: `set currentSeat = :nextSeat, nextStageProtection = :protection add players[0].chips :chipsReduce, players[0].bet :chipsAdd, pot.#total :chipsAdd`,
        ExpressionAttributeValues: {
            ':nextSeat': getNextSeat(game.currentSeat, game.players),
            ':chipsReduce': -betValue,
            ':chipsAdd': betValue,
            ':protection': false
        },
        ExpressionAttributeNames: {
            '#total': 'total'
        }
    }
}