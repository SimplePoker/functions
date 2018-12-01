const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const params = {
        TableName: `SP-Tables-${process.env.STAGE}`,
        Item: {
            id: uuid(),
            stake: event.stake,
            players: [],
            size: 5,
            previousGameId: null,
            currentGameId: null
        }
    }
    await db.put(params).promise()

    return params.Item;
};
