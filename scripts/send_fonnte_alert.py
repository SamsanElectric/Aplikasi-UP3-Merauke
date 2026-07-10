#!/usr/bin/env python3
"""
Peringatan cuaca ringkas untuk tim teknik - Kurik, Merauke
Alur: BMKG (data terbuka) -> olah jadi pesan ringkas -> kirim ke WhatsApp Group via Fonnte

Dijalankan otomatis lewat GitHub Actions (lihat .github/workflows/weather-alert.yml),
BUKAN dari sesi Claude - sesi cloud Claude diblokir mengakses domain BMKG/Fonnte secara
langsung, jadi eksekusi harus terjadi di runner GitHub Actions.

Environment variable yang dibutuhkan (diisi lewat GitHub Secrets):
- FONNTE_TOKEN   : token device Fonnte Anda
- WAG_TARGET     : ID grup WhatsApp tujuan (format: 120363xxxxxxxxx@g.us)
- BMKG_ADM4      : kode wilayah BMKG (default: Kurik, Merauke = 93.01.11.2002)
"""

import os
import sys
from datetime import datetime
import requests

BMKG_ADM4 = os.environ.get("BMKG_ADM4", "93.01.11.2002")  # Kurik, Merauke
FONNTE_TOKEN = os.environ.get("FONNTE_TOKEN", "")
WAG_TARGET = os.environ.get("WAG_TARGET", "")

WIND_WARNING_MS = 10.0   # waspada
WIND_DANGER_MS = 15.0    # bahaya
RAIN_KEYWORDS = ["Hujan", "Petir"]

BMKG_URL = f"https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={BMKG_ADM4}"
FONNTE_URL = "https://api.fonnte.com/send"


def ambil_data_cuaca():
    """Ambil data prakiraan cuaca BMKG untuk lokasi target.

    Struktur asli BMKG: { lokasi: {...}, cuaca: [ [entry, entry, ...], [entry, ...], ... ] }
    'cuaca' adalah list per-hari, tiap hari berisi entry per-3-jam. Kita ratakan (flatten)
    semua entry jadi satu list kronologis.
    """
    resp = requests.get(BMKG_URL, timeout=20)
    resp.raise_for_status()
    payload = resp.json()

    lokasi = payload.get("lokasi", {})
    hari_list = payload.get("cuaca", [])
    entries = [item for hari in hari_list for item in hari]
    return lokasi, entries


def evaluasi_risiko(entries):
    """Tandai setiap entry dengan level risiko berdasarkan ambang angin & kondisi hujan."""
    hasil = []
    for e in entries:
        angin = float(e.get("ws", 0) or 0)
        cuaca = e.get("weather_desc", "") or ""
        level = "normal"
        if angin >= WIND_DANGER_MS or "Petir" in cuaca:
            level = "bahaya"
        elif angin >= WIND_WARNING_MS or "Hujan" in cuaca:
            level = "waspada"
        hasil.append({**e, "alert_level": level})
    return hasil


def susun_pesan(lokasi, entries):
    """Susun pesan ringkas untuk WAG dari hasil evaluasi risiko."""
    nama_lokasi = f"{lokasi.get('desa', '?')}, {lokasi.get('kotkab', '?')}"
    bahaya = [e for e in entries if e["alert_level"] == "bahaya"]
    waspada = [e for e in entries if e["alert_level"] == "waspada"]

    now = datetime.utcnow().strftime("%d %b %Y")
    lines = [
        "*PERINGATAN CUACA - TIM TEKNIK*",
        f"Lokasi: {nama_lokasi} | Update: {now}",
        "Sumber: BMKG Data Terbuka",
        "",
    ]

    if bahaya:
        lines.append("RISIKO TINGGI TERDETEKSI:")
        for e in bahaya[:4]:
            lines.append(
                f"- {e.get('local_datetime', '?')}: {e.get('weather_desc', '?')}, "
                f"angin {e.get('ws', '?')} m/s"
            )
        lines.append("")
        lines.append("Rekomendasi: tunda pekerjaan di ketinggian/alat berat/jaringan udara "
                      "pada jam-jam di atas. Amankan material yang mudah terbawa angin.")
    elif waspada:
        lines.append("Kondisi waspada (angin/hujan sedang terdeteksi). Pantau berkala.")
        for e in waspada[:4]:
            lines.append(
                f"- {e.get('local_datetime', '?')}: {e.get('weather_desc', '?')}, "
                f"angin {e.get('ws', '?')} m/s"
            )
    else:
        lines.append("Tidak ada risiko signifikan terdeteksi untuk periode ini.")

    lines.append("")
    lines.append("_Pesan otomatis - bukan pengganti pemantauan langsung di lapangan._")
    return "\n".join(lines)


def kirim_ke_wag(pesan):
    """Kirim pesan ke WhatsApp Group lewat Fonnte."""
    headers = {"Authorization": FONNTE_TOKEN}
    payload = {"target": WAG_TARGET, "message": pesan}
    resp = requests.post(FONNTE_URL, headers=headers, data=payload, timeout=20)
    resp.raise_for_status()
    return resp.json()


def main():
    if not FONNTE_TOKEN or not WAG_TARGET:
        print("FONNTE_TOKEN atau WAG_TARGET belum diset sebagai secret/environment variable.")
        sys.exit(1)

    lokasi, entries = ambil_data_cuaca()
    entries = evaluasi_risiko(entries)
    pesan = susun_pesan(lokasi, entries)
    print("--- Pesan yang dikirim ---")
    print(pesan)
    print("--------------------------")

    hasil = kirim_ke_wag(pesan)
    print("Hasil kirim Fonnte:", hasil)

    if isinstance(hasil, dict) and hasil.get("status") is False:
        print("Fonnte melaporkan gagal kirim.")
        sys.exit(1)


if __name__ == "__main__":
    main()
