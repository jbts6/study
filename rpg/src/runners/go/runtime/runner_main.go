package main

import (
	"encoding/json"
	"os"
)

func main() {
	var world World
	if err := json.NewDecoder(os.Stdin).Decode(&world); err != nil {
		panic(err)
	}
	result, err := json.Marshal(ChooseTurn(world))
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(os.Getenv("RPG_RESULT_PATH"), result, 0o600); err != nil {
		panic(err)
	}
}
