@echo off

rem Set environment variables
set "users_env=%cd%\user_env"
set "interface_env=%cd%\interface_env"
set "scheduler_env=%cd%\scheduler_env"
set "notification_env=%cd%\notification_env"
set "mentoring_env=%cd%\mentoring_env"

rem Run docker-compose
docker-compose -f docker-compose-mentoring.yml up -d

rem Optionally, clear environment variables after use
set "users_env="
set "interface_env="
set "scheduler_env="
set "notification_env="
set "mentoring_env="

pause
