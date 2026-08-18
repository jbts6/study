package main

import "fmt"

type Config struct {
	Host string
	Port int
}

func normalizeConfig(config Config) Config {
	return config
}

func main() {
	fmt.Println(normalizeConfig(Config{}))
}
