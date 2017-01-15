'use strict';

const fs = require('fs'),
    main = require('./index');

main.handler(JSON.parse(fs.readFileSync('./input.json', 'utf8')), {
    succeed: (result) => {console.info(result)},
    fail: (error) => {console.error(error)}
});
