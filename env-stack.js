#!/usr/bin/env node

var AWS = require('aws-sdk'),
  AWSP = require('./promise-aws'),
  AwsStack = require('./aws-stack')

var stackName = 'online-tax-env'

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
})
AWS.config.credentials = creds

var cloudformation = new AWS.CloudFormation({
  apiVersion: "2010-05-15",
  region: "ap-southeast-2",
})

function randomString() {
  return Math.random().toString(36).substr(2, 6)
}

function createStack(stack) {
  return AwsStack.create(stackName, require('./env-stack.json'))
}

createStack()
