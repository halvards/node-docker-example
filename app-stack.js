var uuid = require('node-uuid');
var shell = require('shelljs');
var AWS = require('aws-sdk');

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
});
AWS.config.credentials = creds;

var cloudformation = new AWS.CloudFormation({
  "apiVersion": "2010-05-15",
  "region": "ap-southeast-2"
});

var randomString = function() {
  return Math.random().toString(36).substr(2, 6);
};

var stack = require('./cf-stack.json');
var userdata = shell.exec("./write-mime-multipart cloud-config.yaml userdata-script.sh", {silent: true}).output;
userdata = userdata.replace(/\$STACK_NAME/g, stackName) // horrible - need to find a better way to include variables in the cloud-config
stack.Resources.Ec2Instance.Properties.UserData["Fn::Base64"] = userdata;
var stackName = "nodeapp-" + randomString();

cloudformation.createStack({
  "StackName": stackName,
  "TemplateBody": JSON.stringify(stack)
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
