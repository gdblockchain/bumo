#!/bin/sh

echo "start"

cd /root/ljz/buchain/bin

if [ $1 = 'copy' ]
then
#scp -r  /root/ljz/buchain root@192.168.10.120:/root/ljz/
    scp /root/ljz/buchain/bin/bumo root@192.168.10.120:/root/ljz/buchain/bin/
#scp -r /root/ljz/buchain root@192.168.10.110:/root/ljz/
    scp /root/ljz/buchain/bin/bumo root@192.168.10.110:/root/ljz/buchain/bin/
#scp -r /root/ljz/buchain root@192.168.10.130:/root/ljz/
    scp /root/ljz/buchain/bin/bumo root@192.168.10.130:/root/ljz/buchain/bin/
#    exit 1
elif [ $1 = 'start' ]
then
    service bumod start ;
    ssh root@192.168.10.110 "service bumod start"
    ssh root@192.168.10.120 "service bumod start"
    ssh root@192.168.10.130 "service bumod start"
elif [ $1 = 'restart' ]
then
    service bumod restart ;
    ssh root@192.168.10.110 "service bumod restart"
    ssh root@192.168.10.120 "service bumod restart"
    ssh root@192.168.10.130 "service bumod restart"
elif [ $1 = 'dw' ]
then
    #python /root/ljz/buchain/bin/test.py -c test_deposit_withdrawal -m 0
    echo 'start dw'
    ssh root@192.168.10.110 "cd /root/ljz/buchain/bin;nohup python /root/ljz/buchain/bin/test.py -c test_deposit_withdrawal -m 1 > dw.log  2>&1 &"
    ssh root@192.168.10.120 "cd /root/ljz/buchain/bin;nohup python /root/ljz/buchain/bin/test.py -c test_deposit_withdrawal -m 2 > dw.log 2>&1 &"
    ssh root@192.168.10.130 "cd /root/ljz/buchain/bin;nohup python /root/ljz/buchain/bin/test.py -c test_deposit_withdrawal -m 3 > dw.log 2>&1 &"
    nohup python /root/ljz/buchain/bin/test.py -c test_deposit_withdrawal -m 0 > dw.log 2>&1 &
fi

echo "end shell $1"

