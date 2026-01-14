#!/bin/bash

# Publish Script für Loggator
# Verwendung: ./scripts/publish.sh [major|minor|patch]

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Hilfe anzeigen
show_help() {
    echo "Verwendung: $0 [major|minor|patch]"
    echo ""
    echo "Optionen:"
    echo "  major   - Erhöht die Major-Version (1.0.0 -> 2.0.0)"
    echo "  minor   - Erhöht die Minor-Version (1.0.0 -> 1.1.0)"
    echo "  patch   - Erhöht die Patch-Version (1.0.0 -> 1.0.1)"
    echo ""
    echo "Beispiel: $0 patch"
    exit 0
}

# Prüfe Argument
if [ -z "$1" ] || [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
fi

TYPE=$1

if [[ ! "$TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo -e "${RED}Fehler: Ungültiger Typ '$TYPE'${NC}"
    echo "Erlaubt sind: major, minor, patch"
    exit 1
fi

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "package.json" ]; then
    echo -e "${RED}Fehler: package.json nicht gefunden${NC}"
    echo "Bitte im Projektverzeichnis ausführen"
    exit 1
fi

# Prüfe ob Git-Arbeitsverzeichnis sauber ist
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warnung: Es gibt uncommittete Änderungen${NC}"
    read -p "Trotzdem fortfahren? (j/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        exit 1
    fi
fi

# Aktuelle Version lesen
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
echo -e "Aktuelle Version: ${YELLOW}$CURRENT_VERSION${NC}"

# Version parsen
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Neue Version berechnen
case $TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo -e "Neue Version:     ${GREEN}$NEW_VERSION${NC}"

# Bestätigung
read -p "Release v$NEW_VERSION erstellen? (j/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Jj]$ ]]; then
    echo "Abgebrochen"
    exit 0
fi

# Version in package.json aktualisieren
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
else
    # Linux
    sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
fi

echo -e "${GREEN}✓${NC} package.json aktualisiert"

# Git commit
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"
echo -e "${GREEN}✓${NC} Änderungen committed"

# Git tag erstellen
git tag "v$NEW_VERSION"
echo -e "${GREEN}✓${NC} Tag v$NEW_VERSION erstellt"

# Push
echo ""
read -p "Änderungen und Tag pushen? (j/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Jj]$ ]]; then
    git push origin HEAD
    git push origin "v$NEW_VERSION"
    echo -e "${GREEN}✓${NC} Gepusht!"
    echo ""
    echo -e "${GREEN}Release v$NEW_VERSION wurde erstellt und gepusht!${NC}"
    echo "GitHub Actions wird jetzt das Docker-Image bauen."
else
    echo ""
    echo -e "${YELLOW}Tag wurde lokal erstellt aber nicht gepusht.${NC}"
    echo "Zum Pushen:"
    echo "  git push origin HEAD"
    echo "  git push origin v$NEW_VERSION"
fi
