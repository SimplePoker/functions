const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {tableId, deckId} = event

    const {cards} = await getDeck(deckId)
    const table = await getTable(tableId)

    const players = table.players.map(player => ({
        ...player,
        cards: pullCardsFn(cards),
        bet: 0
    }))

    const dealer = await getDealer(table)
    await updateDeck(deckId, cards)

    const game = {
        id: uuid(),
        deckId,
        stake: table.stake,
        dealer,
        players,
        phase: 0,
        tableCards: [],
        pot: {
            main: 0,
            total: 0
        }
    }
    return createGame(game)
};

// Database
async function updateDeck(deckId, cards){
    const profileUpdateQuery = {
        TableName : `SP-Decks-${process.env.STAGE}`,
        Key: {id: deckId},
        AttributeUpdates: {
            cards: {
                Action: 'PUT',
                Value: cards
            }
        },
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(profileUpdateQuery).promise()).Attributes
}

async function createGame(game){
    const gamePutQuery = {
        TableName: `SP-Games-${process.env.STAGE}`,
        Item: game
    }
    return (await db.put(gamePutQuery).promise()).Item
}

async function getTable(tableId){
    const tableGetQuery = {
        TableName : `SP-Tables-${process.env.STAGE}`,
        Key: {id: tableId}
    };
    return (await db.get(tableGetQuery).promise()).Item
}

async function getDeck(deckId){
    const deckGetQuery = {
        TableName : `SP-Decks-${process.env.STAGE}`,
        Key: {id: deckId}
    };
    return (await db.get(deckGetQuery).promise()).Item
}

// Helpers
function spliceCard(cards) {
    const randomCardIndex = Math.floor(Math.random() * cards.length);
    return cards.splice(randomCardIndex, 1)[0]
}

function pullCardsFn(cards){
    return [spliceCard(cards), spliceCard(cards)]
}

function nextSeat(seats, previousSeat) {
    return seats.find(n => n > previousSeat) || Math.min(...seats)
}

async function getDealer(table){
    if(table.previousGameId){
        const {dealer: previousDealer} = await getTable(table.previousGameId)
        const seats = table.players.map(p => p.seat)
        return nextSeat(seats, previousDealer)
    } else {
        return table.players[0] && table.players[0].seat || null
    }
}