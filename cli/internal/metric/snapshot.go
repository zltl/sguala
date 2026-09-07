package metric

import (
	"fmt"
	"time"
)

type Disk struct {
	Name  string `json:"name"`
	Total uint64 `json:"total_bytes"`
	Avail uint64 `json:"avail_bytes"`
}

func (d Disk) Used() uint64 {
	if d.Total < d.Avail {
		return 0
	}
	return d.Total - d.Avail
}

func (d Disk) UsedPercent() float64 {
	if d.Total == 0 {
		return 0
	}
	return float64(d.Used()) * 100 / float64(d.Total)
}

type Snapshot struct {
	Host      string    `json:"host"`
	Group     string    `json:"group"`
	Online    bool      `json:"online"`
	CPU       float64   `json:"cpu_percent"`
	MemTotal  uint64    `json:"mem_total_bytes"`
	MemAvail  uint64    `json:"mem_avail_bytes"`
	MemFree   uint64    `json:"mem_free_bytes"`
	Disks     []Disk    `json:"disks"`
	Load1     float64   `json:"load1"`
	Load5     float64   `json:"load5"`
	Load15    float64   `json:"load15"`
	UptimeSec float64   `json:"uptime_sec"`
	Latency   time.Duration `json:"latency_ms"`
	Error     string    `json:"error,omitempty"`
	FetchedAt time.Time `json:"fetched_at"`
}

func (s Snapshot) MemUsed() uint64 {
	if s.MemTotal < s.MemAvail {
		return 0
	}
	return s.MemTotal - s.MemAvail
}

func (s Snapshot) MemUsedPercent() float64 {
	if s.MemTotal == 0 {
		return 0
	}
	return float64(s.MemUsed()) * 100 / float64(s.MemTotal)
}

func (s Snapshot) WorstDisk() (Disk, bool) {
	if len(s.Disks) == 0 {
		return Disk{}, false
	}
	worst := s.Disks[0]
	for _, d := range s.Disks[1:] {
		if d.UsedPercent() > worst.UsedPercent() {
			worst = d
		}
	}
	return worst, true
}

func Offline(host, group string, err error) Snapshot {
	msg := ""
	if err != nil {
		msg = err.Error()
	}
	return Snapshot{
		Host:      host,
		Group:     group,
		Online:    false,
		Error:     msg,
		FetchedAt: time.Now(),
	}
}

func HumanBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%dB", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%c", float64(b)/float64(div), "KMGTPE"[exp])
}
