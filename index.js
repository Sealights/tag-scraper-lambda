'use strict';

const request = require('request').defaults({pool: {maxSockets: 20}}),
    cheerio = require('cheerio'),
    _ = require('lodash'),
    AWS = require('aws-sdk'),
    s3 = new AWS.S3(),
    bucket = 'tag-scraper',
    sources = {
        stackoverflow: 'stackoverflow',
        quora: 'quora',
        reddit: 'reddit'
    },
    errorEmptyBody = new Error('empty response body');

exports.handler = function (input, context) {
    if (!!input) {
        const start = Date.now(),
            promises = [];
        if (input[sources.stackoverflow])
            promises.push(scrapeResourceChannel(sources.stackoverflow, input[sources.stackoverflow]));
        if (input[sources.quora])
            promises.push(scrapeResourceChannel(sources.quora, input[sources.quora]));
        if (input[sources.reddit])
            promises.push(scrapeResourceChannel(sources.reddit, input[sources.reddit]));
        Promise.all(promises)
            .then((results) => {
                console.info(JSON.stringify(results));
                context.succeed({success: input, time: (Date.now() - start)});
            })
            .catch((reason) => {
                handleError(reason, null, context);
            });
    } else handleError('input file empty', null, context);
};

function readS3JsonFile(filename) {
    console.log(`reading: ${filename}`);
    return new Promise((resolve, reject) => {
        s3.getObject({
            Bucket: bucket,
            Key: filename
        }, (err, data) => {
            if (err)
                (err.code == 'NoSuchKey') ? resolve(false) : reject(err, err.stack);
            else {
                try {
                    resolve(JSON.parse(data.Body.toString()));
                } catch (ex) {
                    reject('invalid input: ' + data.Body, null);
                }
            }
        })
    });
}

function writeS3JsonFile(filename, body) {
    const params = {
        Bucket: bucket,
        Key: filename,
        //ACL: 'public-read',
        Body: JSON.stringify(body)
    };
    return new Promise((resolve, reject) => {
        console.log(`writing: ${filename}`);
        s3.deleteObject({Bucket: params.Bucket, Key: params.Key}, (err) => {
            if (err) reject(err, err.stack);
            s3.putObject(params, (err) => {
                if (err) {
                    reject(err, err.stack);
                }
                else resolve(`${params.Key} updated: ${params.Body}`);
            });
        });
    });
}

function scrapeResourceChannel(source, keys) {
    return new Promise((resolve, reject) => {
        let scrapeFunction;
        switch (source) {
            case sources.stackoverflow:
                scrapeFunction = scrapeStackoverflow;
                break;
            case sources.quora:
                scrapeFunction = scrapeQuora;
                break;
            case sources.reddit:
                scrapeFunction = scrapeReddit;
                break;
            default:
                scrapeFunction = false;
                break;
        }
        for (let key of keys) {
            const filename = `${source}-${key}.json`;
            readS3JsonFile(filename)
                .then((output) => {
                    console.log(`comparing to: ${filename}`);
                    if (!scrapeFunction) {
                        reject(`invalid source: ${source}`);
                    }
                    console.log(`scraping: ${source}-${key}`);
                    scrapeFunction(key)
                        .then((result) => {
                            console.log(`scrape finished: ${JSON.stringify(result)}`);
                            writeS3JsonFile(filename, mergeScrapeResultsToOutput(output, result))
                                .then((result) => resolve(result))
                                .catch((reason, stack) => reject(reason, stack))
                        })
                        .catch((reason, stack) => reject(reason, stack));
                })
                .catch((reason, stack) => reject(reason, stack));
        }
    });
}

function scrapeStackoverflow(tag) {
    return new Promise((resolve, reject) => {
        request.get({url: `http://www.stackoverflow.com/questions/tagged/${tag}?sort=newest`}, (error, response) => {
            if (!error && response.body) {
                const $ = cheerio.load(response.body);
                const result = [];
                $('h3').each((i, element) => {
                    if ($(element).parent().attr('class') != 'header')
                        result.push({
                            title: $(element).text(),
                            ref: `http://www.stackoverflow.com${$(element).children('a').attr('href')}`
                        });
                });
                resolve(result);
            }
            else reject(error || errorEmptyBody);
        });
    });
}

function scrapeQuora(topic) {
    return new Promise((resolve, reject) => {
        request.get({url: `http://www.quora.com/topic/${topic}`}, (error, response) => {
            if (!error && response.body) {
                const $ = cheerio.load(response.body);
                const result = [];
                $('div').find('.QuestionText').each((i, element) => {
                    result.push({
                        title: $(element).text(),
                        ref: `http://www.quora.com${$(element).find('.question_link').attr('href')}`
                    });
                });
                resolve(result);
            } else reject(error || errorEmptyBody);
        });
    });
}

function scrapeReddit(subreddit) {
    return new Promise((resolve, reject) => {
        request.get({url: `http://www.reddit.com/r/${subreddit}/new`}, (error, response) => {
            if (!error && response.body) {
                const $ = cheerio.load(response.body);
                const result = [];
                $('p').find('.title').each((i, element) => {
                    result.push({
                        title: $(element).text(),
                        ref: $(element).parents().find('.first').children('a').get(i).attribs.href
                    });
                });
                resolve(result);
            } else reject(error || errorEmptyBody);
        });
    });
}

function mergeScrapeResultsToOutput(output, result) {
    console.log(`merging...`);
    return (!!output) ? _.unionBy(result, output, 'ref') : _.uniqBy(result, 'ref');
}

function handleError(reason, stack, context) {
    console.error(reason, stack);
    (!!context) && context.fail(reason);
}