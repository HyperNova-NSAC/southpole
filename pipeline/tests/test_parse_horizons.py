from pathlib import Path

from pipeline.parse_horizons import parse_result_text, query_url

FIXTURE = Path(__file__).parent / "fixtures" / "horizons_sample.txt"


def test_sun_fixture_has_many_samples_thirty_minutes_apart():
    text = FIXTURE.read_text()
    table = parse_result_text(
        text,
        body="sun",
        site_id="phase0-spike",
        lat_deg=-89.5,
        lon_deg_east=0.0,
        alt_km=0.0,
        query_url_value=query_url("10", "0,-89.5,0", "2027-03-01", "2027-03-04"),
        queried_at="2026-11-14T04:00:00Z",
    )
    assert len(table.samples) > 1
    assert table.samples[0].el_deg == table.samples[0].el_deg  # finite
    assert abs(table.samples[0].el_deg) < 90
    t0 = table.samples[0].t
    t1 = table.samples[1].t
    assert t0 == "2027-03-01T00:00:00Z"
    assert t1 == "2027-03-01T00:30:00Z"
    # Solar disc is about half a degree. The file stores arcseconds.
    assert 0.4 < table.samples[0].ang_diam_deg < 0.7
    assert table.source == "JPL Horizons"
    assert "horizons.api" in table.query_url
