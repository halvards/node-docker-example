#!/usr/bin/env node

// This script is too long and could be vastly simplified by using a mix of
// a CloudFormation template and two API calls: create elasticache replication
// group and create read replica cache cluster.

var Promise = require('es6-promise').Promise;
var AWS = require('aws-sdk');

var creds = new AWS.SharedIniFileCredentials({
  profile: 'company'
});
AWS.config.credentials = creds;

var elasticache = new AWS.ElastiCache({
  "apiVersion": "2014-07-15",
  "region": "ap-southeast-2"
});

var randomString = function() {
  return Math.random().toString(36).substr(2, 6);
};

var suffix = randomString();
var primaryClusterId = "primary-2a-" + suffix;
var replicationGroupId = "repgroup-" + suffix;
var readReplicaClusterId = "replica-2b-" + suffix;

var ec2 = new AWS.EC2({
  "apiVersion": '2014-06-15',
  "region": "ap-southeast-2"
});

function extractPublicAndPrivateSubnets(stack) {
  var describeSubnetPromises = ['Public subnet', 'Private subnet'].
    map(function(subnetTag) {
      return new Promise(function(resolve, reject) {
        ec2.describeSubnets({
          Filters: [{
            Name: 'vpc-id',
            Values: [stack.vpc.VpcId]
          }, {
            Name: 'tag:Name',
            Values: [subnetTag]
          }]
        }, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data);
          }
        });
      });
    });

  return Promise.all(describeSubnetPromises).
    then(function(subnets) {
      stack.publicSubnetId = subnets[0].Subnets[0].SubnetId;
      stack.privateSubnetId = subnets[1].Subnets[0].SubnetId;

      return stack;
    });
}

var cacheSubnetGroupName = 'cache-private-subnet-' + suffix;
var elasticacheSecurityGroupName = "elasticache-redis-access-internal-" + suffix;

new Promise(function(resolve, reject) {
  ec2.describeSecurityGroups({"GroupNames": [elasticacheSecurityGroupName]}, function(err, data) {
    if (err) {
      if (err.code === "InvalidGroup.NotFound") {
        console.log("Security group for ElastiCache Redis cache cluster does not exist. Creating now.");
        resolve(false);  // security group doesn't exist, let's create it
      } else {
        reject(err);
      }
    } else {
      console.log("Security group for ElastiCache Redis cache cluster already exists. Skipping creation.");
      resolve(true);  // security group exists, no need to create it
    }
  });
}).then(function(securityGroupExists) {
  if (!securityGroupExists) {
    return new Promise(function(resolve, reject) {
      ec2.describeVpcs({ Filters: [{ Name: 'tag-key', Values: ['online-tax'] }]}, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data.Vpcs[0]);
        }
      });
    }).then(function(vpc) {
      return new Promise(function(resolve, reject) {
        var securityGroupParams = {
          "GroupName": elasticacheSecurityGroupName,
          "Description": "Enable Redis access on port 6379 from machines in VPC",
          "VpcId": vpc.VpcId
        };
        ec2.createSecurityGroup(securityGroupParams, function(err, data) {
          if (err) {
            reject(err);
          } else {
            resolve({
              vpc: vpc,
              securityGroup: data
            });
          }
        });
      })
    }).then(function(stack) {
      return new Promise(function(resolve, reject) {
        var securityGroupIngressParams = {
          "CidrIp": stack.vpc.CidrBlock,
          "FromPort": 6379,
          "ToPort": 6379,
          "GroupId": stack.securityGroup.GroupId,
          "IpProtocol": "tcp"
        };
        ec2.authorizeSecurityGroupIngress(securityGroupIngressParams, function(err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(stack);
          }
        });
      })
    });
  }
}).then(extractPublicAndPrivateSubnets).
then(function(stack) {
  return new Promise(function(resolve, reject) {
    elasticache.createCacheSubnetGroup({
      CacheSubnetGroupDescription: 'Private subnet cache group',
      CacheSubnetGroupName: cacheSubnetGroupName,
      SubnetIds: [stack.privateSubnetId]
    }, function(err, data) {
      if (err) {
        reject(err);
      } else {
        resolve(stack)
      }
    })
  });
}).then(function(stack) {
  return new Promise(function(resolve, reject) {
    elasticache.createCacheCluster({
      "CacheClusterId": primaryClusterId,
      "CacheNodeType": "cache.t2.micro",
      "Engine": "redis",
      "NumCacheNodes": "1",
      "PreferredAvailabilityZone": "ap-southeast-2a",
      "SecurityGroupIds": [stack.securityGroup.GroupId],
      "CacheSubnetGroupName": cacheSubnetGroupName
    }, function(err, data) {
      if (err) {
        reject(err);
      } else {
        console.log(data);           // successful response
        resolve(data);
      }
    })
  });
}).then(function(data) {
  return new Promise(function(resolve, reject) {
    (function pollUntilAvailable() {
      setTimeout(function(){
        elasticache.describeCacheClusters({ "CacheClusterId": primaryClusterId }, function(err, data) {
          if (err) {
            reject(err);
          } else {
            var status = data.CacheClusters[0].CacheClusterStatus;
            if (status === "available") {
              console.log("Cache cluster [" + primaryClusterId +"] is [" + status + "]");
              resolve(status);
            } else {
              console.log("Cache cluster status for [" + primaryClusterId + "] is [" + status + "], waiting...");
              pollUntilAvailable();
            }
          }
        });
      }, 10 * 1000);
    })();
  });
}).then(function(status) {
  return new Promise(function(resolve, reject) {
    elasticache.createReplicationGroup({
      "PrimaryClusterId": primaryClusterId,
      "ReplicationGroupDescription": "Replication Group",
      "ReplicationGroupId": replicationGroupId
    }, function(err, data) {
      if (err) {
        reject(err);
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });
}).then(function(data) {
  return new Promise(function(resolve, reject) {
    (function pollUntilAvailable() {
      setTimeout(function(){
        elasticache.describeReplicationGroups({ "ReplicationGroupId": replicationGroupId, "MaxRecords": 20 }, function(err, data) {
          if (err) {
            reject(err);
          } else {
            var status = data.ReplicationGroups[0].Status;
            if (status === "available") {
              console.log("Replication group [" + replicationGroupId +"] is [" + status + "]");
              resolve(status);
            } else {
              console.log("Replication group status for [" + primaryClusterId + "] is [" + status + "], waiting...");
              pollUntilAvailable();
            }
          }
        });
      }, 10 * 1000);
    })();
  });
}).then(function(status) {
  return new Promise(function(resolve, reject) {
    elasticache.createCacheCluster({
      "CacheClusterId": readReplicaClusterId,
      "PreferredAvailabilityZone": "ap-southeast-2b",
      "ReplicationGroupId": replicationGroupId
    }, function(err, data) {
      if (err) {
        reject(err);
      } else {
        console.log(data);
        resolve(data);
      }
    });
  });
}).then(function(data) {
  return new Promise(function(resolve, reject) {
    (function pollUntilAvailable() {
      setTimeout(function(){
        elasticache.describeCacheClusters({ "CacheClusterId": readReplicaClusterId }, function(err, data) {
          if (err) {
            reject(err);
          } else {
            var status = data.CacheClusters[0].CacheClusterStatus;
            if (status === "available") {
              console.log("Read replica cache cluster [" + readReplicaClusterId +"] is [" + status + "]");
              resolve(status);
            } else {
              console.log("Read replica cache cluster status for [" + readReplicaClusterId + "] is [" + status + "], waiting...");
              pollUntilAvailable();
            }
          }
        });
      }, 10 * 1000);
    })();
  });
}).catch(function(err) {
  console.log(err, err.stack);
});
