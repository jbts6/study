package main

import "fmt"

type Config struct {
	Host string
	Port int
}

func normalizeConfig(config Config) Config {
	if config.Host == "" {
		config.Host = "127.0.0.1"
	}
	if config.Port == 0 {
		config.Port = 8080
	}
	return config
}

func main() {
	fmt.Println(normalizeConfig(Config{}))
}
