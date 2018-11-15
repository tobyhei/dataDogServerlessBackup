'use strict';

const { S3 } = require('aws-sdk');
const fetch = require('node-fetch');
const {
  BACKUP_BUCKET: bucket,
  DATA_DOG_API_KEY: apiKey,
  DATA_DOG_APP_KEY: appKey
} = process.env;
const client = new S3({ apiVersion: '2006-03-01' });

module.exports.runBackup = async function (event, context) {
  console.log(`Running backup. Logging to ${bucket}`);
  const key = Date.now();
  await Promise.all([
    saveBoards('dash', key),
    saveBoards('screen', key),
    saveMonitors(key)]);
  console.log(`Completed back up to S3`);
}

const saveToS3 = async (key, body) => {
  await client
    .putObject({
      Body: JSON.stringify(body),
      Bucket: bucket,
      Key: key,
    })
    .promise();
};

const dataDogFetch = async (path) => {
  const url = `https://app.datadoghq.com/api/v1/${path}?api_key=${apiKey}&application_key=${appKey}`;
  const response = await fetch(url);
  return await response.json();
};

const saveMonitors = async (key) => {
  const monitors = await dataDogFetch('monitor');
  await saveToS3(`${key}/monitors`, monitors);
}

const saveBoards = async (type, key) => {
  const boards = await dataDogFetch(type, null);
  const listName = type === 'dash' ? 'dashes' : 'screenboards';
  var promises = boards[listName].map(async boardInfo => {
    const board = await dataDogFetch(type + '/' + boardInfo.id);
    await saveToS3(`${key}/${type}/${boardInfo.id}`, board);
  });
  await Promise.all(promises);
}