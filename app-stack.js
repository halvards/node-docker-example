var uuid = require('node-uuid');
var shell = require('shelljs');
var AWS = require('aws-sdk');

var cloudformation = new AWS.CloudFormation({
  "region": "ap-southeast-2"
});

var stack = require('./cf-stack.json');

var userdata = shell.exec("python create_mime.py cloud-config.yaml:cloud-config userdata-script.sh:x-shellscript", {silent: true}).output;
stack.Resources.Ec2Instance.Properties.UserData["Fn::Base64"] = userdata;

cloudformation.createStack({
  "StackName": "nodeapp-" + uuid.v4(),
  "TemplateBody": JSON.stringify(stack)
}, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     console.log(data);           // successful response
});
