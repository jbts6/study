package main

import "testing"

func TestParallelSum(t *testing.T) {
	for _, test := range []struct {
		values []int
		want   int
	}{
		{values: nil, want: 0},
		{values: []int{1, 2, 3, 4, 5}, want: 15},
	} {
		if got := parallelSum(test.values); got != test.want {
			t.Fatalf("parallelSum(%v) = %d, want %d", test.values, got, test.want)
		}
	}
}
