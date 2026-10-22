package web

import (
	"embed"
	"io/fs"
)

//go:embed index.html styles.css app.js
var files embed.FS

func Content() fs.FS {
	return files
}
