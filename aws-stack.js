var AWS = require('aws-sdk');

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
});
AWS.config.credentials = creds;

var cloudformation = new AWS.CloudFormation({
  apiVersion: "2010-05-15",
  region: "ap-southeast-2"
});

function pollUntilAvailable(stackName) {
 setTimeout(function() {
    cloudformation.describeStackEvents({ StackName: stackName }, function(err, data) {
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
           pollUntilAvailable(stackName);
        }
      }
    });
  }, 10 * 1000);
}

module.exports = {
  create: function(stackName, stackTemplate, params) {
    console.log('Creating stack with', params);

    cloudformation.createStack({
      StackName: stackName,
      Capabilities: ['CAPABILITY_IAM'],
      TemplateBody: JSON.stringify(stackTemplate),
      Parameters: params || []
    }, function(err, data) {
      if (err) {
        console.log(err, err.stack);  // an error occurred
      } else {
        console.log(data);
        pollUntilAvailable(stackName)
      }
    });
  }
}
