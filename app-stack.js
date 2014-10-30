#!/usr/bin/env node

var uuid = require('node-uuid');
var shell = require('shelljs');
var AWS = require('aws-sdk');
var Promise = require('es6-promise').Promise;
var AWSP = require('./promise-aws');

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
});
AWS.config.credentials = creds;

var cloudformation = new AWS.CloudFormation({
  "apiVersion": "2010-05-15",
  "region": "ap-southeast-2"
});

var ec2 = new AWSP.EC2({
  "apiVersion": "2014-09-01",
  "region": "ap-southeast-2"
});

function extractPublicAndPrivateSubnets(vpcs) {
  var vpc = vpcs.Vpcs[0]

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

function createStack(stack) {
  console.log('Creating stack with', stack);

  cloudformation.createStack({
    StackName: stackName,
    Capabilities: ['CAPABILITY_IAM'],
    TemplateBody: JSON.stringify(stack),
    Parameters: [{
      ParameterKey: 'VpcId',
      ParameterValue: stack.vpcId
    }, {
      ParameterKey: 'PublicSubnetId',
      ParameterValue: stack.publicSubnetId
    }, {
      ParameterKey: 'PrivateSubnetId',
      ParameterValue: stack.privateSubnetId
    }, {
      ParameterKey: 'PrivateSubnetDefaultSecurityGroupId',
      ParameterValue: stack.privateSubnetDefaultSecurityGroupId
    }]
  }, function(err, data) {
    if (err) {
      console.log(err, err.stack);  // an error occurred
    } else {
      console.log(data);
      (function pollUntilAvailable() {
         setTimeout(function() {
             cloudformation.describeStackEvents({ "StackName": stackName }, function(err, data) {
               if (err) {
                 console.log(err, err.stack);  // an error occurred
               } else {
                 var resourceType = data.StackEvents[0].ResourceType;
                 var status = data.StackEvents[0].ResourceStatus;
                 if (resourceType === "AWS::CloudFormation::Stack" && status === "CREATE_COMPLETE") {
                    console.log("CloudFormation stack [" + stackName +"] is [" + status + "]. Done!");
                    cloudformation.describeStacks({ "StackName": stackName }, function(err, data) {
                      if (err) {
                        console.log(err, err.stack);  // an error occurred
                      } else {
                        data.Stacks[0].Outputs.forEach(function(output) {
                          console.log(output.OutputKey + ": " + output.OutputValue);
                        });
                      }
                    });
                 } else if (resourceType === "AWS::CloudFormation::Stack" && status === "ROLLBACK_COMPLETE") {
                    console.log("CloudFormation stack [" + stackName +"] creation failed with status [" + status + "]");
                 } else {
                    console.log("CloudFormation stack status for [" + stackName +"] and resource type [" + resourceType + "] is [" + status + "], waiting...");
                    pollUntilAvailable();
                 }
               }
             });
         }, 10 * 1000);
       })();
    }
  });
}

var randomString = function() {
  return Math.random().toString(36).substr(2, 6);
};

var stack = require('./cf-stack.json');
var userdata = shell.exec("./write-mime-multipart stack/*", {silent: true}).output;
userdata = userdata.replace(/\$STACK_NAME/g, stackName) // horrible - need to find a better way to include variables in the cloud-config
stack.Resources.Ec2Instance.Properties.UserData["Fn::Base64"] = userdata;
var stackName = "nodeapp-" + randomString();

ec2.describeVpcs({ Filters: [{ Name: 'tag-key', Values: ['online-tax'] }]}).
  then(extractPublicAndPrivateSubnets).
  then(extractPrivateSubnetDefaultSecurityGroup).
  then(createStack).
  catch(function(err) {
    console.log('oh no', err);
  });
