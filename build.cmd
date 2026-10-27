@echo off
rem Сборка сайта: обновляет шапку, футер, каталог и страницы товаров.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
pause
