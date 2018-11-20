const AWS = require('aws-sdk')
const db = new AWS.DynamoDB.DocumentClient()

module.exports.lambda = async (event, context) => {
    const params = {
        TableName: `SP-Profile-Balances-${process.env.STAGE}`,
        Key: {profileId: '1'}, // implement real user id
        UpdateExpression: 'ADD balance :amount',
        ExpressionAttributeValues: {
            ':amount' : parseInt(event.queryStringParameters.amount)
        },
        ReturnValues: 'ALL_OLD'
    }
    await db.update(params).promise()

    return {
        statusCode: 200,
        body: JSON.stringify('updated'),
    };
};
