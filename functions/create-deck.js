const createDeck = require('../domain-logic/deck').createDeck
const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const deck = createDeck()
    const params = {
        TableName: `SP-Decks-${process.env.STAGE}`,
        Item: {
            id: uuid(),
            cards: deck
        }
    }
    await db.put(params).promise()

    return {
        statusCode: 200,
        body: JSON.stringify(params.Item),
    };
};
