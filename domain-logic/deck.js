const flatMap = require('lodash.flatmap');

const cardValues = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14
]
const cardColors = [
    'hearts', 'diamonds', 'spades', 'clubs'
]

function createDeck () {
    return flatMap(cardColors, (symbol) => {
        return cardValues.map((value) => ({
            value: value,
            color: symbol
        }));
    });
}

module.exports = {
    createDeck
}