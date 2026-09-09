package metric

import (
	"testing"
)

func TestParseRemoteStat(t *testing.T) {
	out := `
cpu_x100=1234
mem_total_kb=2048000
mem_free_kb=100000
mem_avail_kb=800000
load1=0.40
load5=0.50
load15=0.60
uptime_sec=3600.5
disks_begin
disk|/dev/sda1|1000000|400000
disk|tmpfs|1|1
disks_end
ok=1
`
	s, err := ParseRemoteStat(out)
	if err != nil {
		t.Fatal(err)
	}
	if !s.Online {
		t.Fatal("expected online")
	}
	if s.CPU < 12.3 || s.CPU > 12.4 {
		t.Fatalf("cpu=%v", s.CPU)
	}
	if s.MemTotal != 2048000*1024 {
		t.Fatalf("mem total=%d", s.MemTotal)
	}
	if len(s.Disks) != 2 {
		t.Fatalf("disks=%d", len(s.Disks))
	}
	if s.Disks[0].UsedPercent() < 59 || s.Disks[0].UsedPercent() > 61 {
		t.Fatalf("disk pct=%v", s.Disks[0].UsedPercent())
	}
}
