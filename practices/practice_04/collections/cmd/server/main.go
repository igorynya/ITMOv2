package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vkusvill-collections/internal/config"
	"vkusvill-collections/internal/generator"
	"vkusvill-collections/internal/httpapi"
	"vkusvill-collections/internal/mcp"
	"vkusvill-collections/internal/store"
	"vkusvill-collections/web"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	level := slog.LevelInfo
	if err := level.UnmarshalText([]byte(cfg.LogLevel)); err != nil {
		return fmt.Errorf("parse log level: %w", err)
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level}))
	slog.SetDefault(logger)

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		return err
	}
	defer st.Close()

	if err := st.Migrate(context.Background()); err != nil {
		return err
	}

	remote := mcp.NewRemote(cfg.MCPURL, cfg.MCPToken, cfg.HTTPTimeout)
	defer remote.Close()

	if err := refresh(context.Background(), st, remote, logger); err != nil {
		return err
	}

	handler := httpapi.New(st, remote, web.Content(), httpapi.Config{
		PerPage:     cfg.CollectionsPerPage,
		CartLinkTTL: cfg.CartLinkTTL,
	}, logger)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		errs <- srv.ListenAndServe()
	}()
	logger.Info("listening", "addr", cfg.Addr, "url", "http://localhost"+cfg.Addr)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errs:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-stop:
		logger.Info("shutting down")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(ctx)
}

func refresh(ctx context.Context, st *store.Store, remote mcp.Client, logger *slog.Logger) error {
	genCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	logger.Info("generating collections", "mcp", "vkusvill")
	started := time.Now()
	collections, err := generator.New(remote, generator.Options{}).Generate(genCtx)
	if err != nil {
		hasActive, checkErr := st.HasActive(ctx)
		if checkErr == nil && hasActive {
			logger.Warn("generation failed, serving previous collections", "error", err)
			return nil
		}
		return fmt.Errorf("generate collections: %w", err)
	}

	saveCtx, saveCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer saveCancel()
	if err := st.SaveGeneration(saveCtx, collections[0].Generation, collections); err != nil {
		return fmt.Errorf("save collections: %w", err)
	}

	logger.Info("collections generated",
		"count", len(collections),
		"duration", time.Since(started).Round(time.Second),
	)
	return nil
}
