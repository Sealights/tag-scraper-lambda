# listener for stackoverflow tags, quora topics and reddit subreddits 

This Lambda service checks for new publications on specified channels, and if exist, adds delta to appropriate s3 target (Kind of like feedly/reader for non-feed html result pages).

The project demonstrates how to integrate Lambda with [AWS S3](https://aws.amazon.com/s3/).

## Prerequisites

If you have never used AWS S3 before, you'll need to first verify bucket named `tag-scraper` exists.

## Try it out

1. run `npm install` to grab the dependencies
2. run `npm start` to set up the lambda project under the default name on AWS 
3. edit the [input.json](input.json) file and set up the keywords in each channel
4. run `npm test` to execute the function manually using the test event
5. Then set it up as a scheduled event on AWS so it runs automatically, by executing `npm run schedule`. This will run the event from `test.json` every five minutes.

## How it works

Check out the [package.json](package.json) scripts section to see how Claudia gets invoked for the `start`, `test` and `schedule` scripts. You can modify
the execution frequency in `package.json` easily and re-create a different event. See the [Schedule Expression Syntax](http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html) for more information on the syntax.

You can see all scheduled events in the [CloudWatch Rules Console](https://console.aws.amazon.com/cloudwatch/), and disable the event there if you don't want to receive any more e-mail notifications.

Check out the [main.js](main.js) file to see how the Lambda function works.
