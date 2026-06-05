#!/bin/bash
version=`date +%Y%m%d_%H%M%S`
cd backend

docker build -t registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-backend_$version .

docker push registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-backend_$version

cd ../pc

docker build -t registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-pc_$version .

docker push registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-pc_$version

cd ../mobile

docker build -t registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-mobile_$version .

docker push registry.cn-hangzhou.aliyuncs.com/f4/web:moe-poc-mobile_$version


