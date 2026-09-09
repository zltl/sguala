package xfer

import (
	"reflect"
	"testing"
)

func TestSplitLocalPaths(t *testing.T) {
	got := SplitLocalPaths("  a  b/c  ")
	want := []string{"a", "b/c"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v", got)
	}
}
