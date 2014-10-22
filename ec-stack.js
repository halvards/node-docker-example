var AWS = require('aws-sdk');

var elasticache = new AWS.ElastiCache({
  "apiVersion": "2014-07-15",
  "region": "ap-southeast-2"
});

var randomString = function() {
  return Math.random().toString(36).substr(2, 6);
};

var primaryClusterId = "tax-2a-" + randomString();

var paramsPrimary = {
  "CacheClusterId": primaryClusterId,
  "CacheNodeType": "cache.t2.micro",
  "Engine": "redis",
  "NumCacheNodes": "1",
  "PreferredAvailabilityZone": "ap-southeast-2a"
};

elasticache.createCacheCluster(paramsPrimary, function(err, data) {
  if (err) {
    console.log(err, err.stack); // an error occurred
  } else {
    console.log(data);           // successful response
    (function pollUntilAvailable() {
       setTimeout(function(){
           elasticache.describeCacheClusters({ "CacheClusterId": primaryClusterId }, function(err, data) {
             if (err) {
               console.log(err, err.stack); // an error occurred
             } else {
               var status = data.CacheClusters[0].CacheClusterStatus;
               if (status === "available") {
                  console.log("Cache cluster [" + primaryClusterId +"] is [" + status + "]. Done!");
               } else {
                  console.log("Cache cluster status for [" + primaryClusterId + "] is [" + status + "], waiting...");
                  pollUntilAvailable();
               }
             }
           });
       }, 10 * 1000);
    })();
  }
});
