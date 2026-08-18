package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func describeUser(user User) string {
	return user.Name
}

func main() {
	fmt.Println(describeUser(User{Name: "Ada", Age: 37}))
}
