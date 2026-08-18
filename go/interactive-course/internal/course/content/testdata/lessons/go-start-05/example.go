package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func describeUser(user User) string {
	return fmt.Sprintf("%s (%d)", user.Name, user.Age)
}

func main() {
	fmt.Println(describeUser(User{Name: "Ada", Age: 37}))
}
