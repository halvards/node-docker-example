#!/bin/bash -ex
easy_install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-latest.tar.gz
echo `date` > /tmp/created_date
