select 
    name, 
    sum(CASE WHEN recorddurationdays IS NULL  
        THEN JulianDay('now') - JulianDay(datetime(date, 'unixepoch'))
        ELSE recorddurationdays END )
        AS recorddurationdays
from t1 where wasrecord = 'true' group by name