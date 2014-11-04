#!/usr/bin/env node

var uuid = require('node-uuid');
var AWS = require('aws-sdk');
var Promise = require('es6-promise').Promise;
var AWSP = require('./promise-aws');
var AwsStack = require('./aws-stack');
var shell = require('shelljs');

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
});
AWS.config.credentials = creds;

var ec2 = new AWSP.EC2({
  "apiVersion": "2014-09-01",
  "region": "ap-southeast-2"
});

function findOnlineTaxVpc() {
  return ec2.describeVpcs({ Filters: [{ Name: 'tag-key', Values: ['online-tax'] }]}).
    then(function (vpcs) {
      return vpcs.Vpcs[0]
    });
}

function extractPublicAndPrivateSubnets(vpc) {
  var describeSubnetPromises = ['Public subnet', 'Private subnet'].
    map(function(subnetTag) {
      return ec2.describeSubnets({
        Filters: [{
          Name: 'vpc-id',
          Values: [vpc.VpcId]
        }, {
          Name: 'tag:Name',
          Values: [subnetTag]
        }]
      });
    });

  return Promise.all(describeSubnetPromises).
    then(function(subnets) {
      return {
        vpcId: vpc.VpcId,
        publicSubnetId: subnets[0].Subnets[0].SubnetId,
        privateSubnetId: subnets[1].Subnets[0].SubnetId,
      };
    });
}

function extractPrivateSubnetDefaultSecurityGroup(state) {
  return ec2.describeSecurityGroups({
    Filters: [{
      Name: 'group-name',
      Values: ['default']
    }, {
      Name: 'vpc-id',
      Values: [state.vpcId]
    }]
  }).then(function(securityGroups) {
    return {
      vpcId: state.vpcId,
      publicSubnetId: state.publicSubnetId,
      privateSubnetId: state.privateSubnetId,
      privateSubnetDefaultSecurityGroupId: securityGroups.SecurityGroups[0].GroupId,
    }
  })
}

function createStack(params) {
  var stackName = "nodeapp-" + randomString();

  var stackTemplate = require('./app-stack.json');
  var userdata = shell.exec("./write-mime-multipart stack/*", {silent: true}).output;
  userdata = userdata.replace(/\$STACK_NAME/g, stackName) // horrible - need to find a better way to include variables in the cloud-config
  stackTemplate.Resources.Ec2Instance.Properties.UserData["Fn::Base64"] = userdata;

  AwsStack.create(stackName, stackTemplate, [{
    ParameterKey: 'VpcId',
    ParameterValue: params.vpcId
  }, {
    ParameterKey: 'PublicSubnetId',
    ParameterValue: params.publicSubnetId
  }, {
    ParameterKey: 'PrivateSubnetId',
    ParameterValue: params.privateSubnetId
  }, {
    ParameterKey: 'PrivateSubnetDefaultSecurityGroupId',
    ParameterValue: params.privateSubnetDefaultSecurityGroupId
  }])
}

function randomString() {
  return Math.random().toString(36).substr(2, 6);
}

findOnlineTaxVpc().
  then(extractPublicAndPrivateSubnets).
  then(extractPrivateSubnetDefaultSecurityGroup).
  then(createStack).
  catch(function(err) {
    console.log('oh no', err);
  });
