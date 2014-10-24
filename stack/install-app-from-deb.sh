#!/bin/bash -ex

set -e

BUCKET=services.company
FILE=the-app/latest.deb
DOWNLOAD_DEST=/tmp/latest.deb

apt-get install -y python python-pip
pip install boto
python -c "import boto; boto.connect_s3().get_bucket('$BUCKET').get_key('$FILE').get_contents_to_file(open('$DOWNLOAD_DEST', 'w'))"
dpkg -i $DOWNLOAD_DEST
service the-app start
rm $DOWNLOAD_DEST
