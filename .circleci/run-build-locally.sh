#!/usr/bin/env bash
curl --user ${CI_USER}: \
    --request POST \
    --form revision=ee2382c1f3be40ef772c143cbdbe3b6a9d921228\
    --form config=@config.yml \
    --form notify=false \
        https://circleci.com/api/v1.1/project/github/SimplePoker/functions/tree/staging