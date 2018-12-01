const AWS = require('aws-sdk')
const range = require('lodash.range')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const {tableId, profileId} = event

    const table = await getTable(tableId)

    // Table full exception
    if(table.players.length === table.size){
        return 'The table is full'
    }

    // Helper variables
    const seatsTaken = table.players.map(p => p.seat)
    const availableSeats = range(1, table.size+1, [1]).filter(n => !seatsTaken.includes(n))
    const minimalChipsEntry = table.stake * 10
    const chips = event.chips > minimalChipsEntry ? event.chips : minimalChipsEntry

    let profile = await getProfile(profileId)

    // Not enough funds exception
    if(profile.bankroll < chips){
        return 'Not enough funds'
    }

    profile = await reduceBankroll(profileId, chips)

    const player = {
        id: profileId,
        seat: availableSeats[0],
        chips
    }
    await joinToTable(tableId, player)

    return profile
};

async function getTable(tableId){
    const tableGetQuery = {
        TableName : `SP-Tables-${process.env.STAGE}`,
        Key: {id: tableId}
    };
    return (await db.get(tableGetQuery).promise()).Item
}

async function getProfile(profileId){
    const profileGetQuery = {
        TableName : `SP-Profiles-${process.env.STAGE}`,
        Key: {id: profileId}
    };
    return (await db.get(profileGetQuery).promise()).Item
}

async function reduceBankroll(profileId, chips){
    const profileUpdateQuery = {
        TableName : `SP-Profiles-${process.env.STAGE}`,
        Key: {id: profileId},
        AttributeUpdates: {
            bankroll: {
                Action: 'ADD',
                Value: -(chips)
            }
        },
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(profileUpdateQuery).promise()).Attributes
}

async function joinToTable(tableId, player){
    const tableUpdateQuery = {
        TableName : `SP-Tables-${process.env.STAGE}`,
        Key: {id: tableId},
        AttributeUpdates: {
            players: {
                Action: 'ADD',
                Value: [player]
            }
        },
        ReturnValues: 'ALL_NEW'
    }
    return (await db.update(tableUpdateQuery).promise()).Attributes
}
