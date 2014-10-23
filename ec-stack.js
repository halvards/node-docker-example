var Promise = require('es6-promise').Promise;
var AWS = require('aws-sdk');

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

var primaryCacheClusterParams = {
  "CacheClusterId": primaryClusterId,
  "CacheNodeType": "cache.t2.micro",
  "Engine": "redis",
  "NumCacheNodes": "1",
  "PreferredAvailabilityZone": "ap-southeast-2a"
};

var replicationGroupParams = {
  "PrimaryClusterId": primaryClusterId,
  "ReplicationGroupDescription": "Replication Group",
  "ReplicationGroupId": replicationGroupId
};

var readReplicaClusterParams = {
  "CacheClusterId": readReplicaClusterId,
  "PreferredAvailabilityZone": "ap-southeast-2b",
  "ReplicationGroupId": replicationGroupId
};

new Promise(function(resolve, reject) {
  elasticache.createCacheCluster(primaryCacheClusterParams, function(err, data) {
    if (err) {
      reject(err);
    } else {
      console.log(data);           // successful response
      resolve(data);
    }
  })
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
    elasticache.createReplicationGroup(replicationGroupParams, function(err, data) {
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
    elasticache.createCacheCluster(readReplicaClusterParams, function(err, data) {
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
