@echo off
cd /d "C:\Users\agusl\.gemini\antigravity\scratch\agentops-studio"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/AgusLujan-AL/agentops-studio.git
echo Subiendo AgentOps Studio a https://github.com/AgusLujan-AL/agentops-studio ...
git push -u origin main
pause
