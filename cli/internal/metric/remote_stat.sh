#!/bin/sh
# Single round-trip collector for sguala-cli. Output is line-oriented key=value.
set -eu

# --- cpu (two samples ~0.2s apart) ---
read_cpu() {
  # shellcheck disable=SC2034
  read -r _ user nice system idle iowait irq softirq steal _rest < /proc/stat
  total=$((user + nice + system + idle + iowait + irq + softirq + steal))
  idle_all=$((idle + iowait))
  echo "$total $idle_all"
}

set -- $(read_cpu)
t1=$1; i1=$2
sleep 0.2
set -- $(read_cpu)
t2=$1; i2=$2
dt=$((t2 - t1))
di=$((i2 - i1))
if [ "$dt" -gt 0 ]; then
  # percent used * 100 (integer, e.g. 1234 = 12.34%)
  cpu_x100=$(( (10000 * (dt - di)) / dt ))
else
  cpu_x100=0
fi
echo "cpu_x100=$cpu_x100"

# --- memory (kB from /proc/meminfo) ---
mem_total=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
mem_free=$(awk '/^MemFree:/ {print $2}' /proc/meminfo)
mem_avail=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
if [ -z "$mem_avail" ]; then
  buffers=$(awk '/^Buffers:/ {print $2}' /proc/meminfo)
  cached=$(awk '/^Cached:/ {print $2}' /proc/meminfo)
  mem_avail=$((mem_free + buffers + cached))
fi
echo "mem_total_kb=$mem_total"
echo "mem_free_kb=$mem_free"
echo "mem_avail_kb=$mem_avail"

# --- load / uptime ---
if [ -r /proc/loadavg ]; then
  read -r l1 l5 l15 _rest < /proc/loadavg
  echo "load1=$l1"
  echo "load5=$l5"
  echo "load15=$l15"
fi
if [ -r /proc/uptime ]; then
  read -r up _idle < /proc/uptime
  echo "uptime_sec=$up"
fi

# --- disks: name|total_kb|avail_kb (skip pseudo) ---
echo "disks_begin"
df -P -k 2>/dev/null | awk 'NR>1 {
  name=$1
  total=$2
  avail=$4
  if (name ~ /^(tmpfs|devtmpfs|udev|none|overlay|shm)$/) next
  if (name ~ /\/dev\/loop/) next
  printf "disk|%s|%s|%s\n", name, total, avail
}'
echo "disks_end"

echo "ok=1"
