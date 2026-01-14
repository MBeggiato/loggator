#!/bin/bash

# Loggator Startup Script
# Erstellt .env Datei falls nicht vorhanden und startet die Services

set -e

echo "🚀 Loggator Startup Script"
echo "=========================="

# Prüfe ob .env existiert
if [ ! -f .env ]; then
    echo "📝 .env Datei nicht gefunden, erstelle aus .env.example..."
    cp .env.example .env
    echo "⚠️  WICHTIG: Bitte .env bearbeiten und MEILISEARCH_MASTER_KEY ändern!"
    echo ""
fi

# Docker Socket prüfen
if [ ! -S /var/run/docker.sock ]; then
    echo "❌ Docker Socket nicht gefunden: /var/run/docker.sock"
    echo "   Stelle sicher, dass Docker läuft und du Zugriff hast."
    exit 1
fi

echo "🐳 Starte Loggator mit Docker Compose..."
docker compose up -d

echo ""
echo "✅ Loggator wurde gestartet!"
echo ""
echo "📊 Services:"
echo "   - Loggator UI:  http://localhost:3000"
echo "   - Meilisearch:  http://localhost:7700"
echo "   - Demo App:     http://localhost:8080"
echo ""
echo "📝 Logs anzeigen:"
echo "   docker-compose logs -f loggator"
echo ""
echo "🏷️  Container für Monitoring markieren:"
echo "   Label hinzufügen: loggator.enable=true"
echo ""
