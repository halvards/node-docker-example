'use strict';

var AWS = require('aws-sdk');
var Promise = require('es6-promise').Promise;
require('es6-collections');

function promiseCallback(resolve, reject) {
  return function(err, data) {
    if (err) {
      reject(err)
    } else {
      resolve(data)
    }
  }
}

module.exports = {
  EC2: function(params) {
    var ec2 = new AWS.EC2(params);

    return ['describeVpcs', 'describeSubnets', 'describeSecurityGroups'].reduce(function(obj, fnname) {
      obj[fnname] = function(params) {
        return new Promise(function(resolve, reject) {
          ec2[fnname](params, promiseCallback(resolve, reject));
        });
      };
      return obj;
    }, {});
  },

  S3: function(params) {
    var s3 = new AWS.S3(params);

    return ['listBuckets', 'getBucketTagging', 'putObject'].reduce(function(obj, fnname) {
      obj[fnname] = function(params) {
        return new Promise(function(resolve, reject) {
          s3[fnname](params, promiseCallback(resolve, reject));
        });
      };
      return obj;
    }, {});
  }
};
