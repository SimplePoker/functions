const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const params = {
        TableName: `SP-Profiles-${process.env.STAGE}`,
        Item: {
            id: uuid(),
            nickname: event.nickname,
            bankroll: 8000
        }
    }
    await db.put(params).promise()

    return params.Item;
};
