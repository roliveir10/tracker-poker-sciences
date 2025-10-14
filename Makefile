.PHONY: up setup install db parse dev preview clean prisma reload reparse reset

# Usage:
#   make up                # install + migrate (SQLite) + parse fixture + dev
#   make up FILE=/abs/path/to/Betclic.txt
#   make preview           # just start the dev server
#   make prisma            # regenerate prisma client + migrate (SQLite)
#   make reload            # prisma + parse (rapide, sans redémarrer le serveur)
#   make reparse           # re-importer uniquement (si serveur déjà lancé)
#   make reset             # wipe dev DB + migrations, puis remigre et reparse

up: setup dev

setup: install db parse

install:
	npm install

db:
	npm run db:generate
	npm run db:migrate:deploy

parse:
	FILE="$(FILE)" npm run dev:parse

dev:
	npm run dev

preview:
	npm run dev

clean:
	rm -f prisma/dev.db
	rm -rf prisma/migrations

# Raccourcis pratiques
prisma: db-dev

reload: prisma parse

reparse: parse

reset: clean prisma parse


