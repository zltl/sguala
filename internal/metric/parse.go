package metric

import (
	"fmt"
	"strconv"
	"strings"
)

func ParseRemoteStat(out string) (Snapshot, error) {
	s := Snapshot{Online: true}
	lines := strings.Split(out, "\n")
	inDisks := false
	ok := false

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if line == "disks_begin" {
			inDisks = true
			continue
		}
		if line == "disks_end" {
			inDisks = false
			continue
		}
		if inDisks {
			if strings.HasPrefix(line, "disk|") {
				parts := strings.Split(line, "|")
				if len(parts) != 4 {
					continue
				}
				totalKB, err1 := strconv.ParseUint(parts[2], 10, 64)
				availKB, err2 := strconv.ParseUint(parts[3], 10, 64)
				if err1 != nil || err2 != nil {
					continue
				}
				s.Disks = append(s.Disks, Disk{
					Name:  parts[1],
					Total: totalKB * 1024,
					Avail: availKB * 1024,
				})
			}
			continue
		}

		key, val, okKV := strings.Cut(line, "=")
		if !okKV {
			continue
		}
		switch key {
		case "cpu_x100":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return s, fmt.Errorf("cpu_x100: %w", err)
			}
			s.CPU = v / 100
		case "mem_total_kb":
			v, err := strconv.ParseUint(val, 10, 64)
			if err != nil {
				return s, err
			}
			s.MemTotal = v * 1024
		case "mem_free_kb":
			v, err := strconv.ParseUint(val, 10, 64)
			if err != nil {
				return s, err
			}
			s.MemFree = v * 1024
		case "mem_avail_kb":
			v, err := strconv.ParseUint(val, 10, 64)
			if err != nil {
				return s, err
			}
			s.MemAvail = v * 1024
		case "load1":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return s, err
			}
			s.Load1 = v
		case "load5":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return s, err
			}
			s.Load5 = v
		case "load15":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return s, err
			}
			s.Load15 = v
		case "uptime_sec":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return s, err
			}
			s.UptimeSec = v
		case "ok":
			ok = val == "1"
		}
	}
	if !ok {
		return s, fmt.Errorf("remote script did not report ok=1")
	}
	return s, nil
}
