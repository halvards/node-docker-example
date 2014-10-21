var uuid = require('node-uuid');
var AWS = require('aws-sdk');
var cloudformation = new AWS.CloudFormation({
  "region": "ap-southeast-2"
});

var stack = {
  "AWSTemplateFormatVersion" : "2010-09-09",

  "Description" : "Create an EC2 instance running Ubuntu 14.04 LTS.",

  "Parameters" : {
    "KeyName" : {
      "Description" : "Name of and existing EC2 KeyPair to enable SSH access to the instance",
      "Type" : "String",
      "Default": "ec2-keypair-ap-syd"
    },
    "InstanceTypeParameter" : {
    "Type" : "String",
    "Default" : "t2.micro",
    "AllowedValues" : ["t2.micro", "t2.small", "t2.medium"],
    "Description" : "Enter t2.micro, t2.small, or t2.medium. Default is t2.micro."
  }
  },

  "Mappings" : {
    "RegionMap" : {
        "ap-southeast-2" : {
          "AMI" : "ami-1f117325"
      }
    }
  },

  "Resources" : {
    "Ec2Instance" : {
      "Type" : "AWS::EC2::Instance",
      "Properties" : {
        "SecurityGroups" : [ { "Ref" : "InstanceSecurityGroup" } ],
        "KeyName" : { "Ref" : "KeyName" },
        "ImageId" : { "Fn::FindInMap" : [ "RegionMap", { "Ref" : "AWS::Region" }, "AMI" ]},
        "Tags": [
          { "Key": "Name", "Value": "The Server" }
        ],
        "UserData" : { "Fn::Base64" : { "Fn::Join" : ["",[
            "#!/bin/bash -ex","\n",
            "add-apt-repository --yes ppa:chris-lea/node.js","\n",
            "apt-get update","\n"
            "apt-get -y install nodejs","\n",
            "apt-get -y install build-essential","\n",
            "apt-get -y install postgresql","\n"
            ]]}}
      }
    },

    "InstanceSecurityGroup" : {
      "Type" : "AWS::EC2::SecurityGroup",
      "Properties" : {
        "GroupDescription" : "Enable SSH access via port 22",
        "SecurityGroupIngress" : [ {
          "IpProtocol" : "tcp",
          "FromPort" : "22",
          "ToPort" : "22",
          "CidrIp" : "0.0.0.0/0"
        } ]
      }
    }
  },

  "Outputs" : {
    "InstanceId" : {
      "Description" : "InstanceId of the newly created EC2 instance",
      "Value" : { "Ref" : "Ec2Instance" }
    },
    "AZ" : {
      "Description" : "Availability Zone of the newly created EC2 instance",
      "Value" : { "Fn::GetAtt" : [ "Ec2Instance", "AvailabilityZone" ] }
    },
    "PublicIP" : {
      "Description" : "Public IP address of the newly created EC2 instance",
      "Value" : { "Fn::GetAtt" : [ "Ec2Instance", "PublicIp" ] }
    }
  }
};

cloudformation.createStack({
  "StackName": "nodeapp-" + uuid.v4(),
  "TemplateBody": JSON.stringify(stack)
}, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     console.log(data);           // successful response
});